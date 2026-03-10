// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials"; 
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
// ★ 不安定の元だった cookies, headers のインポートを完全に消去しました

export const authOptions: NextAuthOptions = {
  // @ts-ignore
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    
    CredentialsProvider({
      id: "webauthn",
      name: "WebAuthn",
      credentials: {
        email: { label: "Email", type: "text" },
        response: { label: "Response", type: "text" }, 
        host: { label: "Host", type: "text" }, // ★ 確実なURLを受け取ります
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.response || !credentials?.host) {
          throw new Error("必要な情報が足りません");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { authenticators: true }
        });

        if (!user || user.authenticators.length === 0) {
          throw new Error("このメールアドレスには生体認証が登録されていません");
        }

        // ★ クッキーではなく、先ほどDBに保存した合言葉を取り出します
        const expectedChallenge = user.currentChallenge;
        if (!expectedChallenge) {
          throw new Error("認証の制限時間が切れました。もう一度お試しください。");
        }

        const response = JSON.parse(credentials.response);
        const authenticator = user.authenticators.find(a => {
          const base64urlId = Buffer.from(a.credentialID, 'base64').toString('base64url');
          return base64urlId === response.id;
        });

        if (!authenticator) {
          throw new Error("登録されていない端末です");
        }

        // 確実なURL（host）から検証情報を組み立てます
        const protocol = credentials.host.includes('localhost') ? 'http' : 'https';
        const expectedOrigin = `${protocol}://${credentials.host}`;
        const expectedRPID = credentials.host.split(':')[0];

        let verification;
        try {
          verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge,
            expectedOrigin,
            expectedRPID,
            authenticator: {
              credentialID: Buffer.from(authenticator.credentialID, 'base64'),
              credentialPublicKey: Buffer.from(authenticator.credentialPublicKey, 'base64'),
              counter: authenticator.counter,
              transports: authenticator.transports ? (authenticator.transports.split(',') as any) : undefined,
            },
          });
        } catch (error) {
          console.error("生体認証の解析エラー:", error);
          throw new Error("生体データの解析に失敗しました");
        }

        if (verification.verified && verification.authenticationInfo) {
          // 認証成功後、合言葉を空にして防犯対策を施します
          await prisma.user.update({
            where: { id: user.id },
            data: { 
              currentChallenge: null,
              lastLoginAt: new Date() // ついでに来店刻印もここで押します
            }
          });
          
          await prisma.authenticator.update({
            where: { id: authenticator.id },
            data: { counter: verification.authenticationInfo.newCounter }
          });
          
          return user;
        } else {
          throw new Error("生体認証の審査に落ちました");
        }
      }
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.plan = (user as any).plan;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).plan = token.plan;
      }
      return session;
    },
  },
  events: {
    // 通常のGoogleログイン時の刻印用
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user?.id) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
        } catch (error) {
          console.error("[HabiTap Error] 刻印失敗:", error);
        }
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import axiosInstance from "@/axiosInstance";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          const { data } = await axiosInstance.post("/api/auth/login", {
            email: credentials.email,
            password: credentials.password
          });

          if (data?.user && data?.token) {
            return {
              ...data.user,
              accessToken: data.token
            };
          }
          return null;
        } catch (err) {
          console.error("Credentials login error:", err.response?.data || err.message);
          return null;
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user?.accessToken) {
        token.accessToken = user.accessToken;
        token.id = user._id || user.id;
        token.email = user.email;
        token.name = user.name;
      }

      if (account?.provider && profile) {
        try {
          const { data } = await axiosInstance.post("/api/auth/oauth-login", {
            provider: account.provider,
            providerAccountId: account.id,
            email: profile.email,
            name: profile.name,
          });

          if (data?.user && data?.token) {
            token.accessToken = data.token;
            token.id = data.user._id || data.user.id;
            token.email = data.user.email;
            token.name = data.user.name;
          }
        } catch (err) {
          console.error("OAuth login error:", err.response?.data || err.message);
          return null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.email = token.email;
      session.user.name = token.name;
      session.accessToken = token.accessToken;
      return session;
    }
  },

  pages: {
    signIn: "/login"
  }
};

export default NextAuth(authOptions);
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
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
    })
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.id = user._id || user.id;
        token.email = user.email;
        token.name = user.name;
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

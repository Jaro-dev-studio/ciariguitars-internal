"server-only";

import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { AuthOptions } from "next-auth";
import { getUserPermissions, getPageAccessPaths, getFeatureAccessKeys } from "@/lib/permissions";

const providers = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { email: credentials.email },
      });

      if (!user) {
        return null;
      }

      const adminPass = process.env.ADMIN_PASS;
      if (adminPass && credentials.password === adminPass && user.role !== "ADMIN") {
        const permissions = await getUserPermissions(user.id);
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          pageAccess: getPageAccessPaths(permissions),
          featureAccess: getFeatureAccessKeys(permissions),
        };
      }

      const isPasswordValid = await bcrypt.compare(
        credentials.password,
        user.password
      );

      if (!isPasswordValid) {
        return null;
      }

      const permissions = await getUserPermissions(user.id);
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        pageAccess: getPageAccessPaths(permissions),
        featureAccess: getFeatureAccessKeys(permissions),
      };
    },
  }),
];

export const authOptions: AuthOptions = {
  providers,
  session: {
    strategy: "jwt",
    maxAge: 6 * 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.userId = user.id;
        token.email = user.email;
        token.name = user.name;
        token.image = user.image;
        token.role = user.role;
        token.pageAccess = user.pageAccess;
        token.featureAccess = user.featureAccess;
      }
      return token;
    },

    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.userId;
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.image = token.image;
        session.user.role = token.role;
        session.user.pageAccess = token.pageAccess;
        session.user.featureAccess = token.featureAccess;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
};

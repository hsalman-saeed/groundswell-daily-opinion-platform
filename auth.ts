import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { query } from "@/lib/db/dsql"
import bcrypt from "bcryptjs"

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }
        const email = credentials.email as string
        const password = credentials.password as string

        try {
          const res = await query(
            "SELECT player_id, username, email, hashed_password, country_code, country_name, age_bucket, current_streak FROM players WHERE email = $1",
            [email]
          )

          if (res.rows.length === 0) {
            return null
          }

          const user = res.rows[0]
          const isValid = await bcrypt.compare(password, user.hashed_password)

          if (!isValid) {
            return null
          }

          return {
            id: user.player_id,
            name: user.username,
            email: user.email,
            country_code: user.country_code,
            country_name: user.country_name,
            age_bucket: user.age_bucket,
            current_streak: user.current_streak,
          }
        } catch (error) {
          console.error("Auth authorize error:", error)
          return null
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.player_id = user.id
        token.username = user.name
        const u = user as any
        token.country_code = u.country_code
        token.country_name = u.country_name
        token.age_bucket = u.age_bucket
        token.current_streak = u.current_streak
      }
      return token
    },
    session({ session, token }) {
      if (session.user && token) {
        const u = session.user as any
        u.id = token.player_id as string
        u.player_id = token.player_id as string
        u.username = token.username as string
        u.country_code = token.country_code as string
        u.country_name = token.country_name as string
        u.age_bucket = token.age_bucket as string
        u.current_streak = token.current_streak as number
      }
      return session
    },
  },
  pages: {
    signIn: "/signin",
  },
})

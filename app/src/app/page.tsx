import { redirect } from "next/navigation";
import { auth } from "@/auth";

// This was the untouched create-next-app scaffold page — never replaced
// since every real screen lives under its own route. Root visitors just
// need sending to the right place.
export default async function Home() {
  const session = await auth();
  redirect(session?.user ? "/dashboard" : "/login");
}

import { redirect } from "next/navigation";

export default function Home() {
  // Einstieg: Middleware leitet nicht angemeldete Nutzer auf /login.
  redirect("/dashboard");
}

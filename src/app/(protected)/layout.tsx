import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import DashboardSidebar from "@/features/dashboard/components/DashboardSidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims(); // Extracts the JWT claims present in the access token by first verifying the JWT against the server's JSON Web Key Set endpoint
  // data: {
  //       claims: JwtPayload;
  //       header: JwtHeader;
  //       signature: Uint8Array;
  //   };

  if (!data?.claims) redirect("/login"); // if JWT is not present, redirect to login page

  return (
    <>
      <DashboardSidebar />
      {children}
      <ToastContainer
        position="top-center"
        closeButton
        newestOnTop
        limit={1}
        autoClose={4000}
        hideProgressBar
        draggable={false}
        pauseOnHover
        theme="colored"
      />
    </>
  );
}

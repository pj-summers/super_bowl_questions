import AdminClient from "./AdminClient";

export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <AdminClient code={code.toUpperCase()} />;
}

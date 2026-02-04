import LeaderboardClient from "./LeaderboardClient";

export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <LeaderboardClient code={code.toUpperCase()} />;
}

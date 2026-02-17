import CrowdStatsClient from "./CrowdStatsClient";

export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <CrowdStatsClient code={code.toUpperCase()} />;
}

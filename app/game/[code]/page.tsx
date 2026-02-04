import GameClient from "./GameClient";

export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params; // ✅ unwrap params promise
  return <GameClient code={code.toUpperCase()} />;
}

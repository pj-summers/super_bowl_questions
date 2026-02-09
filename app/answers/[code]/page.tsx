import AnswersClient from "./AnswersClient";

export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <AnswersClient code={code.toUpperCase()} />;
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { questionId, correctOption, key } = body as {
      questionId: string;
      correctOption: string | null;
      key: string;
    };

    if (!process.env.ADMIN_KEY) {
      return NextResponse.json({ error: "ADMIN_KEY not set" }, { status: 500 });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY not set" },
        { status: 500 }
      );
    }
    if (key !== process.env.ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const qid = String(questionId ?? "").trim();
    if (!qid) {
      return NextResponse.json({ error: "Missing questionId" }, { status: 400 });
    }

    const value =
  correctOption == null || String(correctOption).trim() === ""
    ? null
    : String(correctOption);

if (!value) {
  return NextResponse.json(
    { error: "Missing correctOption" },
    { status: 400 }
  );
}

const { data: existing, error: existingError } = await supabase
  .from("questions")
  .select("resolved_at")
  .eq("id", qid)
  .single();

if (existingError || !existing) {
  return NextResponse.json(
    { error: existingError?.message ?? "Question not found" },
    { status: 400 }
  );
}

const resolvedAt =
  existing.resolved_at ?? new Date().toISOString();

const { data: updated, error } = await supabase
  .from("questions")
  .update({
    correct_option: value,
    resolved_at: resolvedAt,
  })
  .eq("id", qid)
  .select("correct_option, resolved_at")
  .single();

if (error) {
  return NextResponse.json(
    { error: error.message },
    { status: 400 }
  );
}

return NextResponse.json({
  ok: true,
  correctOption: updated.correct_option,
  resolvedAt: updated.resolved_at,
});
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Bad request" },
      { status: 400 }
    );
  }
}

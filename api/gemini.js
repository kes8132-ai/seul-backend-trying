// ===================================================
// Vercel 서버리스 함수: Gemini API를 호출하여 AI 코멘트를 생성합니다.
//
// 개인정보 보호 규칙 (AGENTS.md 준수):
//   - uid, 이메일, 작성자 이름 등 식별 정보는 일절 Gemini에 전달하지 않습니다.
//   - 순수 메모 텍스트(text)만 전송합니다.
//   - API 키는 process.env.GEMINI_API_KEY 환경변수에서 안전하게 읽어옵니다.
// ===================================================

export default async function handler(req, res) {
  // CORS 및 POST 메서드 체크
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 허용됩니다." });
  }

  const { text } = req.body || {};

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "코멘트를 생성할 메모 내용(text)이 필요합니다." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY가 설정되지 않았습니다. Vercel 환경 변수(Environment Variables)에 GEMINI_API_KEY를 추가해 주세요."
    });
  }

  try {
    // 무료 티어로 제공되는 gemini-1.5-flash 모델 사용
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    // 교실 담벼락에 어울리는 다정하고 따뜻한 피드백 프롬프트
    const prompt = `당신은 학교 교실의 다정하고 따뜻한 선생님입니다.
아래 학생의 메모를 읽고, 깊은 공감과 따뜻한 칭찬, 격려의 말을 1~2문장(한국어, 다정한 어투)으로 짧게 남겨주세요. 적절한 이모티콘도 1~2개 곁들여주세요.

[메모 내용]
${text}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 150
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Gemini API 호출 실패 (상태 코드: ${response.status})`);
    }

    const data = await response.json();
    const comment = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "언제나 너를 응원해! ✨";

    return res.status(200).json({ comment });
  } catch (error) {
    console.error("Gemini 호출 중 오류:", error);
    return res.status(500).json({ error: error.message || "AI 코멘트 생성 중 오류가 발생했습니다." });
  }
}

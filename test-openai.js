// OpenAI API 키 테스트 스크립트
const OPENAI_API_KEY = "여기에_실제_API_키를_붙여넣으세요";

fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Say 'Hello World' in one word." }
    ],
  }),
})
.then(res => res.json())
.then(data => {
  console.log("✅ Success:", data);
  if (data.error) {
    console.error("❌ API Error:", data.error);
  } else {
    console.log("Response:", data.choices[0].message.content);
  }
})
.catch(err => console.error("❌ Network Error:", err));

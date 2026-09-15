import { google } from "@ai-sdk/google";
import { generateText } from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { image, mediaType } = await req.json();

  if (!image || typeof image !== "string") {
    return Response.json({ error: "No image provided" }, { status: 400 });
  }

  try {
    const { text } = await generateText({
      model: google("gemini-3.6-flash"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcribe el texto de esta foto de un ticket o recibo. Devuelve el texto tal como aparece, respetando los saltos de línea, sin añadir ni resumir nada.",
            },
            {
              type: "image",
              image,
              mediaType: mediaType ?? "image/jpeg",
            },
          ],
        },
      ],
    });

    return Response.json({ text });
  } catch (error) {
    console.error("Transcribe error:", error);
    return Response.json(
      { error: "Error al transcribir la imagen" },
      { status: 500 },
    );
  }
}
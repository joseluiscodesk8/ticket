import { google } from "@ai-sdk/google";
import {
  Output,
  extractJsonMiddleware,
  generateText,
  wrapLanguageModel,
} from "ai";
import { z } from "zod";

export const maxDuration = 30;

const schema = z.object({
  address: z
    .string()
    .nullable()
    .describe(
      "SOLO la nomenclatura del lugar en formato de calle con número (p. ej. 'CRA 33 # 42-8', 'Calle 50 # 10-20'). NO incluyas nombres de torre, conjunto, edificio, apartamento, barrio ni ciudad. Si no aparece ninguna nomenclatura, devuelve null",
    ),
  phone: z
    .string()
    .nullable()
    .describe("El número de teléfono que aparece en el ticket, o null si no aparece"),
  price: z
    .string()
    .nullable()
    .describe("El precio o total que aparece en el ticket, o null si no aparece"),
});

export async function POST(req: Request) {
  const { image, mediaType } = await req.json();

  if (!image || typeof image !== "string") {
    return Response.json({ error: "No image provided" }, { status: 400 });
  }

  try {
    const model = wrapLanguageModel({
      model: google("gemini-3.5-flash"),
      middleware: extractJsonMiddleware(),
    });

    const result = await generateText({
      model,
      output: Output.object({ schema }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Mira esta foto de un ticket o recibo y extrae solo estos tres datos:\n1. Nomenclatura (address): SOLO el formato de calle con número, p. ej. 'CRA 33 # 42-8' o 'Calle 50 # 10-20'. NO incluyas nombre de torre, conjunto, edificio, apartamento, barrio ni ciudad. Si no aparece ninguna nomenclatura, devuelve null.\n2. Teléfono (phone).\n3. Precio total (price).\nDevuelve el valor tal como aparece en el ticket. Si un dato no aparece en la foto, devuélvelo como null. No transcribas el texto completo del ticket.",
            },
            {
              type: "file",
              data: image,
              mediaType: mediaType ?? "image/jpeg",
            },
          ],
        },
      ],
    });

    const extracted = result.output;

    return Response.json({
      address: extracted.address ?? "",
      phone: extracted.phone ?? "",
      price: extracted.price ?? "",
    });
  } catch (error) {
    console.error("Transcribe error:", error);
    return Response.json(
      { error: "Error al transcribir la imagen" },
      { status: 500 },
    );
  }
}
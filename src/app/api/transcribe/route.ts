import { google } from "@ai-sdk/google";
import {
  Output,
  extractJsonMiddleware,
  generateText,
  wrapLanguageModel,
} from "ai";
import { z } from "zod";
import { DEFAULT_MODEL, isModelId } from "@/lib/models";

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
  const { image, mediaType, model, width, height, bytes } = await req.json();

  if (!image || typeof image !== "string") {
    return Response.json({ error: "No image provided" }, { status: 400 });
  }

  const requested = isModelId(model) ? model : undefined;
  const modelId =
    requested ??
    (isModelId(process.env.GEMINI_MODEL) ? process.env.GEMINI_MODEL : DEFAULT_MODEL);

  try {
    const modelInstance = wrapLanguageModel({
      model: google(modelId),
      middleware: extractJsonMiddleware(),
    });

    const result = await generateText({
      model: modelInstance,
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
      model: modelId,
      usage: {
        input: result.usage?.inputTokens ?? 0,
        output: result.usage?.outputTokens ?? 0,
        total: result.usage?.totalTokens ?? 0,
      },
      echo: {
        width: typeof width === "number" ? width : null,
        height: typeof height === "number" ? height : null,
        bytes: typeof bytes === "number" ? bytes : null,
      },
    });
  } catch (error) {
    console.error("Transcribe error:", error);
    const statusCode = (error as { statusCode?: number })?.statusCode ?? 500;
    const responseBody = (error as { responseBody?: string })?.responseBody;
    let quota: unknown = null;
    if (responseBody) {
      try {
        quota = JSON.parse(responseBody);
      } catch {
        quota = responseBody;
      }
    }
    if (statusCode === 429) {
      return Response.json(
        {
          error:
            "Se agotaron los tokens de esta versión. Prueba otra versión o espera a que se renueve el cupo.",
          quota,
        },
        { status: 429 },
      );
    }
    return Response.json({ error: "Error al transcribir la imagen" }, { status: 500 });
  }
}
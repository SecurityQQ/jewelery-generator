import { GoogleGenAI } from '@google/genai';


export async function runGemini(input: Record<string, unknown>): Promise<string> {
    const model = 'gemini-2.5-flash-image-preview'
    const prompt = String(input.prompt || '')
    if (!prompt) throw new Error('Prompt is required')
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('Google API key is not configured')

    const ai = new GoogleGenAI({ apiKey })
    const parts: any[] = []

    // Collect any provided image URLs from known fields
    const imageUrls = (await extractImageUrlsFromInput(input)).slice(0, 3) // enforce max 3

    // Convert to inlineData parts
    for (const url of imageUrls) {
        try {
            const res = await fetch(url)
            if (!res.ok) continue
            const contentType = res.headers.get('content-type') || 'image/png'
            // Enforce allowed mime types
            const allowed = ['image/png', 'image/jpeg', 'image/webp']
            if (!allowed.includes(contentType)) {
                continue
            }
            // Enforce 7MB max size
            const contentLength = Number(res.headers.get('content-length') || '0')
            if (contentLength > 7 * 1024 * 1024) {
                continue
            }
            const buf = await res.arrayBuffer()
            const base64 = Buffer.from(buf).toString('base64')
            parts.push({ inlineData: { mimeType: contentType, data: base64 } })
        } catch (_) {
            // Skip bad images silently
        }
    }

    // Add the text prompt last
    parts.push({ text: prompt })
    const response = await ai.models.generateContent({
        model: model,
        contents: { parts }
    })
    const responseParts = (response as any)?.candidates?.[0]?.content?.parts || []
    const imagePart = responseParts.find((p: any) => p?.inlineData)
    if (imagePart?.inlineData) {
        const { mimeType, data } = imagePart.inlineData
        return `data:${mimeType};base64,${data}`
    }
    const finishReason = (response as any)?.candidates?.[0]?.finishReason
    if (finishReason && finishReason !== 'STOP') {
        throw new Error(`Image generation stopped unexpectedly. Reason: ${finishReason}`)
    }
    throw new Error('Gemini did not return an image')
}

async function extractImageUrlsFromInput(input: Record<string, unknown>): Promise<string[]> {
    const urls: string[] = []
    const maybePush = (val: unknown) => {
        if (typeof val === 'string' && /^https?:\/\//i.test(val)) urls.push(val)
    }

    const arr = input.images
    if (Array.isArray(arr)) {
        for (const item of arr) {
            maybePush(item)
        }
    }

    return Array.from(new Set(urls))
}


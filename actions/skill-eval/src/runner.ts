import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModelV1 } from 'ai'

export function getModel(provider: string, apiKey: string, modelId: string): LanguageModelV1 {
  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey })(modelId)
    case 'openai':
      return createOpenAI({ apiKey })(modelId)
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(modelId)
    default:
      throw new Error(`Unsupported provider: ${provider}. Use 'anthropic', 'openai', or 'google'.`)
  }
}

export async function runSkillPrompt(
  model: LanguageModelV1,
  systemPrompt: string,
  userMessage: string,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const { text, usage } = await generateText({
    model,
    system: systemPrompt,
    prompt: userMessage,
  })
  
  return {
    text,
    inputTokens: usage?.promptTokens ?? 0,
    outputTokens: usage?.completionTokens ?? 0,
  }
}

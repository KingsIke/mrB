import { 
  Injectable, 
  InternalServerErrorException, 
  NotFoundException, 
  ForbiddenException,
  Logger, 
  HttpException 
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { Repository } from 'typeorm';
import { ChatSession } from './entities/chat-session.entity';
import { ChatMessage } from './entities/chat-message.entity';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI;

  private readonly modelsToTry = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
  ];

  constructor(
    private configService: ConfigService,
    @InjectRepository(ChatSession)
    private sessionRepo: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private messageRepo: Repository<ChatMessage>,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateResponse(
    message: string, 
    userId: string, 
    chatId?: string,
    files: Express.Multer.File[] = []
  ) {
    try {
      let session: ChatSession | null;

      // 1. Find or create the Chat Session
      if (chatId) {
        session = await this.sessionRepo.findOne({ where: { id: chatId } });
        if (!session) throw new NotFoundException('Chat session not found');
        if (session.userId !== userId) {
          throw new ForbiddenException('You do not have access to this chat session');
        }
      } else {
        const titleText = message || (files.length > 0 ? 'Multimodal Chat' : 'New Chat');
        session = this.sessionRepo.create({
          userId,
          title: titleText.length > 30 ? `${titleText.substring(0, 30)}...` : titleText,
        });
        await this.sessionRepo.save(session);
      }

      // 2. Save incoming User message
      const userMessage = this.messageRepo.create({
        session,
        role: 'user',
        content: message || (files.length > 0 ? '[Attached Media]' : ''),
      });
      await this.messageRepo.save(userMessage);

      // 3. Fetch LATEST 10 past messages
      const recentHistory = await this.messageRepo.find({
        where: { session: { id: session.id } },
        order: { createdAt: 'DESC' },
        take: 10,
      });

      const history = recentHistory.reverse();

      // 4. Convert Multer upload files to Gemini InlineData Parts
      const fileParts: Part[] = files.map((file) => ({
        inlineData: {
          data: file.buffer.toString('base64'),
          mimeType: file.mimetype,
        },
      }));

      // 5. Format prompt array for Gemini
      const contents = history.map((msg, index) => {
        const isCurrentMessage = index === history.length - 1;
        const textContent = msg.content || 'Analyze the provided file(s).';
        const parts: Part[] = [{ text: textContent }];

        if (isCurrentMessage && fileParts.length > 0) {
          parts.unshift(...fileParts);
        }

        return {
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts,
        };
      });

      // 6. Query Gemini API with Fallback and Retry Handling
      const result = await this.executeWithModelFallback(contents);
      const reply = result.response.text();

      // 7. Save Assistant message
      const assistantMessage = this.messageRepo.create({
        session,
        role: 'assistant',
        content: reply,
      });
      await this.messageRepo.save(assistantMessage);

      return {
        chatId: session.id,
        reply,
        usage: result.response.usageMetadata,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Gemini AI Service failure: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        error.message || 'Failed to process AI request',
      );
    }
  }

  private async executeWithModelFallback(contents: any[]) {
    let lastError: Error | null = null;

    for (const modelName of this.modelsToTry) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: 'You are a helpful AI assistant.',
        });

        return await model.generateContent({
          contents,
          generationConfig: {
            temperature: 0.7,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Model ${modelName} failed: ${err.message}. Trying next fallback...`);
        lastError = err;

        if (err.message?.includes('429')) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    throw lastError || new Error('All Gemini model endpoints failed.');
  }

  async getUserChatHistory(userId: string) {
    return this.sessionRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: ['messages'],
    });
  }

  async getChatMessages(chatId: string) {
    const session = await this.sessionRepo.findOne({
      where: { id: chatId },
      relations: ['messages'],
      order: { messages: { createdAt: 'ASC' } },
    });

    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async deleteChatSession(chatId: string, userId: string) {
    const session = await this.sessionRepo.findOne({
      where: { id: chatId },
    });

    if (!session) {
      throw new NotFoundException('Chat session not found');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('You do not have access to delete this chat session');
    }

    // Delete associated messages first if cascade delete is not set on the entity relationship
    await this.messageRepo.delete({ session: { id: chatId } });

    await this.sessionRepo.remove(session);

    return { message: 'Chat session deleted successfully', chatId };
  }
}
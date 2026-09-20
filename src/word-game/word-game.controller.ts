import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WordGameService } from './word-game.service';
import { SubmitGuessDto } from './dto/submit-guess.dto';

@ApiTags('Word Game')
@Controller('word-game')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WordGameController {
  constructor(private readonly wordGameService: WordGameService) {}

  @Get('today')
  @ApiOperation({ summary: "Get today's puzzle progress" })
  async getToday(@CurrentUser('userId') userId: string) {
    return this.wordGameService.getToday(userId);
  }

  @Post('guess')
  @ApiOperation({ summary: "Submit a guess for today's word" })
  async submitGuess(@CurrentUser('userId') userId: string, @Body() dto: SubmitGuessDto) {
    return this.wordGameService.submitGuess(userId, dto.guess);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get my word game streak and stats' })
  async getStats(@CurrentUser('userId') userId: string) {
    return this.wordGameService.getStats(userId);
  }
}

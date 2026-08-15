import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';

import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { Note } from './entities/note.entity';

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note)
    private readonly notesRepository: Repository<Note>,
  ) {}

  async create(userId: string, createNoteDto: CreateNoteDto): Promise<Note> {
    const note = this.notesRepository.create(
      ({
        ...createNoteDto,
        userId,
      } as DeepPartial<Note>),
    );
    return this.notesRepository.save(note);
  }

  async findAll(
    userId: string,
    search?: string,
    category?: string,
  ): Promise<Note[]> {
    const query = this.notesRepository
      .createQueryBuilder('note')
      .where('note.userId = :userId', { userId });

    if (search) {
      query.andWhere(
        '(LOWER(note.title) LIKE LOWER(:search) OR LOWER(note.content) LIKE LOWER(:search) OR LOWER(note.department) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    if (category && category !== 'All Notes' && category !== 'Bookmarks') {
      query.andWhere('note.category = :category', { category });
    }

    if (category === 'Bookmarks') {
      query.andWhere('note.isBookmarked = true');
    }

    return query
      .orderBy('note.isPinned', 'DESC')
      .addOrderBy('note.createdAt', 'DESC')
      .getMany();
  }

  async findOne(userId: string, id: string): Promise<Note> {
    const note = await this.notesRepository.findOne({
      // TypeORM FindOptionsWhere may not include custom properties like userId
      // so cast to any to satisfy TypeScript while keeping runtime behavior.
      where: { id, userId } as any,
    });

    if (!note) {
      throw new NotFoundException(`Note with ID "${id}" not found`);
    }

    return note;
  }

  async update(
    userId: string,
    id: string,
    updateNoteDto: UpdateNoteDto,
  ): Promise<Note> {
    const note = await this.findOne(userId, id);
    Object.assign(note, updateNoteDto);
    return this.notesRepository.save(note);
  }

  async togglePin(userId: string, id: string): Promise<Note> {
    const note = await this.findOne(userId, id);
    note.isPinned = !note.isPinned;
    return this.notesRepository.save(note);
  }

  async toggleBookmark(userId: string, id: string): Promise<Note> {
    const note = await this.findOne(userId, id);
    note.isBookmarked = !note.isBookmarked;
    return this.notesRepository.save(note);
  }

  async remove(userId: string, id: string): Promise<void> {
    const note = await this.findOne(userId, id);
    await this.notesRepository.remove(note);
  }
}
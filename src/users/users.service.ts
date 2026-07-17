import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: ['school'],
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { username: username.toLowerCase().trim() },
    });
  }

  // New method: Finds which usernames from a list are already taken
  async findTakenUsernames(usernames: string[]): Promise<string[]> {
    const records = await this.userRepository.find({
      where: { username: In(usernames) },
      select: ['username'],
    });
    return records.map(r => r.username.toLowerCase());
  }

  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
  return this.userRepository.findOne({ where: { phoneNumber } });
}

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      relations: ['school'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    // Fetch without relations: a loaded ManyToOne relation (e.g. `school`) takes
    // precedence over a directly-assigned FK column (e.g. `schoolId`) on save,
    // silently reverting the FK to whatever the stale loaded relation was.
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    // Check email uniqueness if changing
    if (data.email && data.email !== user.email) {
      const existing = await this.findByEmail(data.email);
      if (existing && existing.id !== id) {
        throw new ConflictException('Email already in use');
      }
    }

    // Check username uniqueness if changing
    if (data.username && data.username !== user.username) {
      const existing = await this.findByUsername(data.username);
      if (existing && existing.id !== id) {
        throw new ConflictException('Username already taken');
      }
    }

    Object.assign(user, data);
    await this.userRepository.save(user);
    return (await this.findById(id))!;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    await this.userRepository.remove(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    return this.update(userId, {
      ...dto,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    });
  }
}

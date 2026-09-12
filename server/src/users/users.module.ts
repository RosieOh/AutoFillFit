import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resume } from '../resume/entities/resume.entity';
import { Profile } from './entities/profile.entity';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Profile, Resume])],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}

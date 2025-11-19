import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthorRequest, AuthorRequestSchema } from './schemas/author_request.schema';
import { AuthorRequestsService } from './author_requests.service';
import { AuthorRequestsController } from './author_requests.controller';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuthorRequest.name, schema: AuthorRequestSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AuthorRequestsController],
  providers: [AuthorRequestsService],
  exports: [AuthorRequestsService],
})
export class AuthorRequestsModule {}



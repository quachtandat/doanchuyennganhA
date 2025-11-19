import { PagingDto } from 'src/common/dto/paging.dto';
import { IsOptional, IsString } from 'class-validator';

export class QueryUserDto extends PagingDto {
	@IsOptional()
	@IsString()
	q?: string;

	@IsOptional()
	@IsString()
	role?: string;
}

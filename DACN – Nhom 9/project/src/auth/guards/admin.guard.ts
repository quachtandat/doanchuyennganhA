/* eslint-disable prettier/prettier */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    // Allow token via Authorization header or ?token=... query parameter or cookie named accessToken
    const authorization = request.headers?.authorization;
    const queryToken = request.query?.token;
    const cookieToken = request.cookies?.accessToken;

    let token: string | undefined = undefined;
    if (authorization) {
      token = authorization.startsWith('Bearer ') ? authorization.slice(7) : authorization;
    } else if (queryToken) {
      token = queryToken;
    } else if (cookieToken) {
      token = cookieToken;
    }

    if (!token) {
      throw new UnauthorizedException('No authorization token provided');
    }

    try {
      const payload = this.jwtService.verify(token);
      
      if (payload.role !== 'admin') {
        throw new ForbiddenException('Only admin users can access this resource');
      }

      request.user = payload;
      return true;
    } catch (err) {
      if (err instanceof ForbiddenException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

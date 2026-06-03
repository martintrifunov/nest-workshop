import { Injectable, UnauthorizedException } from '@nestjs/common';
import { compare } from 'bcryptjs';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async signIn(
    username: string,
    pass: string,
  ): Promise<{ access_token: string }> {
    const user = await this.usersService.findOne(username);
    if (!user) {
      throw new UnauthorizedException();
    }

    const passwordMatches = await compare(pass, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException();
    }

    const payload = { username: user.username, sub: user.id, role: user.role };
    return { access_token: await this.jwtService.signAsync(payload) };
  }
}

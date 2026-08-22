import { UnauthorizedException } from '@nestjs/common';

import { JwtStrategy } from './jwt.strategy';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Unit tests de JwtStrategy. El constructor lee `JWT_SECRET`, así que se fija
 * en beforeEach. Invariante: `validate` solo exige que el payload tenga `sub`.
 */
describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  const secret = 'test-jwt-secret';

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    strategy = new JwtStrategy();
  });

  describe('validate()', () => {
    it('devuelve el payload cuando contiene sub', () => {
      const payload: JwtPayload = {
        sub: 'user-1',
        name: 'Admin Uno',
        username: 'admin',
        role: 'admin',
      };

      expect(strategy.validate(payload)).toEqual(payload);
    });

    it('lanza UnauthorizedException si el payload no tiene sub', () => {
      expect(() =>
        strategy.validate({ username: 'admin', role: 'admin' } as JwtPayload),
      ).toThrow(UnauthorizedException);
    });
  });
});

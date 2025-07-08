// User class for test server
import jwt from 'jsonwebtoken'

export class User {
  constructor() {
    this.JWT_SECRET = 'test-jwt-secret-key'
  }

  // Helper to create real JWT tokens matching BAPI format
  createJWTToken(userId, expiresIn = '30d') {
    return jwt.sign(
      {
        sub: userId,  // BAPI uses 'sub' claim for user ID
        iat: Math.floor(Date.now() / 1000)
      },
      this.JWT_SECRET,
      {
        expiresIn,
        algorithm: 'HS256'  // Using HS256 instead of RS512 for testing simplicity
      }
    )
  }

  createRefreshToken(userId) {
    // BAPI uses 256-character random hex strings for refresh tokens
    return Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')
  }

  // Helper to create user response
  createUserResponse(email = 'test@example.com', isRefresh = false) {
    const userId = '00000000-0000-0000-0000-000000000123'
    return {
      id_user: userId,
      name: 'Test User',
      email: email,
      email_verified: true,
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z',
      billing_email: null,
      billing_address: null,
      parent_user_id: null,
      has_trialed: false,
      is_admin: false,
      api_token: null,
      api_test_token: null,
      editor_preferences: {},
      public_preferences: {},
      network: 'email',
      is_child: false,
      subscription: null,
      tokens: {
        access: this.createJWTToken(userId, isRefresh ? '30d' : '30d'),
        refresh: this.createRefreshToken(userId)
      }
    }
  }

  // Authentication middleware
  validateAuth = (req, res, next) => {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(403).json({
        message: 'Forbidden',
        statusCode: 403
      })
    }

    const token = authHeader.substring(7)

    try {
      req.user = { id: jwt.verify(token, this.JWT_SECRET).sub }
      next()
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          statusCode: 401,
          message: 'access_token_expired',
          error: 'Unauthorized'
        })
      }
      
      return res.status(403).json({
        message: 'Forbidden',
        statusCode: 403
      })
    }
  }

  // Test utility functions for creating specific token types
  createExpiredToken(id = '00000000-0000-0000-0000-000000000123') {
    return jwt.sign(
      {
        sub: id,
        iat: Math.floor(Date.now() / 1000) - 3600,  // 1 hour ago
        exp: Math.floor(Date.now() / 1000) - 1800   // 30 minutes ago (expired)
      }, this.JWT_SECRET, { algorithm: 'HS256' }
    )
  }

  createValidToken(id = '00000000-0000-0000-0000-000000000123') {
    return this.createJWTToken(id)
  }

  createMalformedToken() {
    return 'invalid.jwt.token'
  }
}

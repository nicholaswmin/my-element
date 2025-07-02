// Mock server mimicking BAPI - uses exact Bitpaper endpoints

import express from 'express'

export function createTestServer() {
  const app = express()
  app.use(express.json())
  
  let server
  let port
  const requests = []
  
  app.use((req, res, next) => {
    requests.push({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body
    })
    next()
  })
  
  // Helper to create user response
  const createUserResponse = (email = 'test@example.com', isRefresh = false) => ({
    id_user: '00000000-0000-0000-0000-000000000123',
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
      access: isRefresh ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new.' + Date.now() : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access.' + Date.now(),
      refresh: isRefresh ? 'new-refresh-' + Date.now() : 'refresh-token-' + Date.now()
    }
  })
  
  // Signup endpoint - matches BAPI exactly
  app.post('/api/user/signup', (req, res) => {
    const { firstName, lastName, email, password } = req.body
    
    // Validation - matches BAPI ValidationPipe behavior
    if (!firstName || typeof firstName !== 'string') {
      return res.status(400).json({
        message: ["firstName should not be empty", "firstName must be a string"],
        error: "Bad Request",
        statusCode: 400
      })
    }
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        message: ["email should not be empty", "email must be a string"],
        error: "Bad Request",
        statusCode: 400
      })
    }
    
    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        message: ["password should not be empty", "password must be a string"],
        error: "Bad Request",
        statusCode: 400
      })
    }
    
    // Email already taken - matches EmailAlreadyTakenException
    if (email === 'taken@example.com') {
      return res.status(400).json({
        status: 'error',
        errorMessage: 'email_already_taken'
      })
    }
    
    // Password too short - matches PasswordTooShortException
    if (password.length < 6) {
      return res.status(400).json({
        status: 'error',
        errorMessage: 'password_too_short'
      })
    }
    
    // Invalid email format - matches IncorrectEmailFormatException
    if (!email.includes('@')) {
      return res.status(400).json({
        status: 'error',
        errorMessage: 'incorrect_email_format'
      })
    }
    
    // Success - return 201 with user data
    const fullName = lastName ? `${firstName} ${lastName}` : firstName
    res.status(201).json(createUserResponse(email))
  })
  
  app.post('/api/user/login/email', (req, res) => {
    const { email, password } = req.body
    
    if (!email || !password) {
      return res.status(400).json({ 
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request'
      })
    }
    
    // Simulate incorrect credentials - matches IncorrectEmailPasswordException
    if (email !== 'test@example.com' || (password !== 'password123' && password !== 'password')) {
      return res.status(401).json({
        message: 'Incorrect email or password',
        error: 'Unauthorized',
        statusCode: 401
      })
    }
    
    res.status(201).json(createUserResponse(email))
  })
  
  app.post('/api/user/refresh', (req, res) => {
    const { refreshToken } = req.body
    
    if (!refreshToken) {
      return res.status(400).json({ 
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request'
      })
    }
    
    // Simulate refresh token not found - matches RefreshTokenNotFoundException
    if (refreshToken === 'invalid-refresh-token') {
      return res.status(400).json({ 
        status: 'error',
        errorMessage: 'refresh_token_not_found'
      })
    }
    
    // Simulate used/inactive refresh token - matches RefreshTokenInactiveException
    if (refreshToken === 'used-token') {
      return res.status(400).json({ 
        status: 'error',
        errorMessage: 'refresh_token_inactive'
      })
    }
    
    // Handle expired refresh token
    if (refreshToken === 'expired-refresh-token') {
      return res.status(401).json({
        statusCode: 401,
        message: 'Refresh token expired',
        error: 'Unauthorized'
      })
    }
    
    // BAPI refresh endpoint returns 201 (default for POST in NestJS)
    res.status(201).json(createUserResponse('test@example.com', true))
  })
  
  // Middleware to validate auth like BAPI
  const validateAuth = (req, res, next) => {
    const authHeader = req.headers.authorization
    
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      // BAPI returns 403 for missing/malformed auth
      return res.status(403).json({
        message: 'Forbidden',
        statusCode: 403
      })
    }
    
    const token = authHeader.substring(7)
    
    // Simulate expired token - BAPI returns 401
    if (token.includes('old-token') || token.includes('expired-token')) {
      return res.status(401).json({
        statusCode: 401,
        message: 'access_token_expired',
        error: 'Unauthorized'
      })
    }
    
    // Invalid/malformed token returns 403
    if (token === 'invalid-token') {
      return res.status(403).json({
        message: 'Forbidden',
        statusCode: 403
      })
    }
    
    // Token is valid
    req.user = { id: '00000000-0000-0000-0000-000000000123' }
    next()
  }
  
  // Generic test endpoint
  app.get('/api/test', validateAuth, (req, res) => {
    res.json({ data: 'success' })
  })
  
  // Paper save endpoint - matches BAPI exactly
  app.post('/api/user/papers/save', validateAuth, (req, res) => {
    const { id_session, name, type = 'save', tags } = req.body
    
    if (!id_session) {
      return res.status(400).json({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request'
      })
    }
    
    // BAPI returns 204 No Content for successful save
    res.status(204).send()
  })
  
  // Paper create endpoint
  app.post('/api/user/papers', validateAuth, (req, res) => {
    res.status(201).json({
      id: 'paper-123',
      title: req.body.title || 'Untitled',
      created_at: new Date().toISOString()
    })
  })
  
  app.get('/api/user/papers', validateAuth, (req, res) => {
    res.json([
      { id: '1', title: 'Paper 1' },
      { id: '2', title: 'Paper 2' }
    ])
  })
  
  app.get('/api/user/tags', validateAuth, (req, res) => {
    res.json([
      { id: '1', name: 'Important' },
      { id: '2', name: 'Personal' }
    ])
  })
  
  app.post('/api/user/tags', validateAuth, (req, res) => {
    res.status(201).json({
      id: 'tag-' + Date.now(),
      name: req.body.name
    })
  })
  
  app.post('/api/user/saved-paper/exists', validateAuth, (req, res) => {
    // Mock response for paper exists check
    res.json({ exists: false })
  })
  
  // Tags endpoints
  app.patch('/api/tags/:id', validateAuth, (req, res) => {
    res.json({ 
      id: req.params.id, 
      name: req.body.name,
      updated_at: new Date().toISOString()
    })
  })
  
  app.delete('/api/tags/:id', validateAuth, (req, res) => {
    res.status(204).send()
  })
  
  // Paper endpoints
  app.patch('/api/paper/:id', validateAuth, (req, res) => {
    // BAPI returns 204 No Content for paper updates
    res.status(204).send()
  })
  
  app.delete('/api/paper/:id', validateAuth, (req, res) => {
    res.status(204).send()
  })
  
  app.delete('/api/papers/:id', validateAuth, (req, res) => {
    res.status(204).send()
  })
  
  // Alternative error format endpoint for testing
  app.get('/api/alt-error', validateAuth, (req, res) => {
    res.status(400).json({
      status: 'error',
      errorMessage: 'Alternative error message format'
    })
  })
  
  app.get('/api/papers/list', validateAuth, (req, res) => {
    res.json({
      papers: [
        {
          id: 'paper-1',
          title: 'My First Paper',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z'
        },
        {
          id: 'paper-2', 
          title: 'Project Notes',
          created_at: '2024-01-02T00:00:00.000Z',
          updated_at: '2024-01-02T00:00:00.000Z'
        }
      ],
      total: 2
    })
  })
  
  app.get('/api/paper/check-url', validateAuth, (req, res) => {
    const { url } = req.query
    // Return exists: false for most URLs, true for specific test case
    res.json({ 
      exists: url === 'existing-paper-url',
      paper_id: url === 'existing-paper-url' ? 'paper-123' : null
    })
  })
  
  // User preferences endpoints - SPLIT into editor and public
  app.get('/api/user/preferences/editor', validateAuth, (req, res) => {
    res.json({
      selectedStroke: {
        write: { width: 2, color: '#000000', opacity: 1 },
        highlight: { width: 20, color: '#FFFF00', opacity: 0.5 },
        erase: { width: 20 }
      },
      fontSize: 24,
      leading: 1.2,
      colorPresets: ['#000000', '#FF0000', '#00FF00', '#0000FF']
    })
  })
  
  app.patch('/api/user/preferences/editor', validateAuth, (req, res) => {
    // Return the updated preferences
    res.json(req.body)
  })
  
  app.get('/api/user/preferences/public', validateAuth, (req, res) => {
    res.json({
      displayName: 'Test User',
      cursorColor: '#FF0000',
      pointerVisible: true
    })
  })
  
  app.patch('/api/user/preferences/public', validateAuth, (req, res) => {
    // Return the updated preferences
    res.json(req.body)
  })
  
  // RTC token endpoints
  app.post('/api/rtc/opentok/token', validateAuth, (req, res) => {
    const { sessionId } = req.body
    
    if (!sessionId) {
      return res.status(400).json({
        statusCode: 400,
        message: 'sessionId is required',
        error: 'Bad Request'
      })
    }
    
    res.json({ 
      token: `T1==cGFydG5lcl9pZD00NTcyODU5MiZzaWc9NjE5ZjRmOGQ5ZjY5NzdhNWI0${Date.now()}`,
      apiKey: '45728592',
      sessionId: sessionId
    })
  })
  
  app.get('/api/rtc/twilio/token', validateAuth, (req, res) => {
    res.json({ 
      token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.${Date.now()}`,
      identity: req.user.id
    })
  })
  
  // Paper call token endpoint - matches whiteboard-page.hbs
  app.post('/api/paper/:paperId/call/token', validateAuth, (req, res) => {
    res.json({ 
      token: `rtc-token-${req.params.paperId}-${Date.now()}`,
      sessionId: `session-${req.params.paperId}`,
      apiKey: '45728592'
    })
  })
  
  // Twilio call endpoint - matches whiteboard-page.hbs
  app.post('/api/paper/:idSession/call/twilio', validateAuth, (req, res) => {
    res.json({ 
      token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.${Date.now()}`,
      identity: req.user.id,
      roomName: `room-${req.params.idSession}`
    })
  })
  
  // OpenTok call endpoint - matches whiteboard-page.hbs
  app.post('/api/paper/:idSession/call/opentok', validateAuth, (req, res) => {
    res.json({ 
      token: `T1==cGFydG5lcl9pZD00NTcyODU5MiZzaWc9NjE5ZjRmOGQ5ZjY5NzdhNWI0${Date.now()}`,
      apiKey: '45728592',
      sessionId: `opentok-session-${req.params.idSession}`
    })
  })
  
  // Asset management - signed URL generation
  app.post('/api/upload/signed-url', validateAuth, (req, res) => {
    const { filename, type } = req.body
    
    if (!filename || !type) {
      return res.status(400).json({
        statusCode: 400,
        message: 'filename and type are required',
        error: 'Bad Request'
      })
    }
    
    // Mock S3 signed URL response
    res.json({ 
      url: `https://bitpaper-dev.s3.amazonaws.com/${Date.now()}-${filename}`,
      fields: {
        'Content-Type': type,
        'key': `uploads/${Date.now()}-${filename}`,
        'bucket': 'bitpaper-dev',
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': 'AKIAIOSFODNN7EXAMPLE/20240101/us-east-1/s3/aws4_request',
        'X-Amz-Date': '20240101T000000Z',
        'Policy': 'eyJleHBpcmF0aW9uIjoiMjAyNC0wMS0wMVQwMTowMDowMFoiLCJjb25kaXRpb25zIjpbXX0=',
        'X-Amz-Signature': 'example-signature'
      }
    })
  })
  
  app.get('/api/paper/:paperId/assets/:assetKey/signed-url', validateAuth, (req, res) => {
    res.json({ 
      url: `https://bitpaper-dev.s3.amazonaws.com/papers/${req.params.paperId}/assets/${req.params.assetKey}?X-Amz-SignedHeaders=host&X-Amz-Expires=3600`
    })
  })
  
  return {
    async start() {
      return new Promise((resolve) => {
        server = app.listen(0, () => {
          port = server.address().port
          resolve(`http://localhost:${port}`)
        })
      })
    },
    
    async stop() {
      if (server) {
        return new Promise((resolve) => {
          server.close(() => {
            server = null
            port = null
            resolve()
          })
        })
      }
    },
    
    getRequests: () => requests,
    clearRequests: () => requests.length = 0
  }
}
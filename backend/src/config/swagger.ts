import swaggerJSDoc from 'swagger-jsdoc';
import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RaaS (Recruitment as a Service) API',
      version: '1.0.0',
      description:
        'Comprehensive recruitment platform API with advanced features for job posting, candidate management, and recruitment workflows.',
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
      contact: {
        name: 'RaaS Support',
        email: 'support@raas.com',
        url: 'https://raas.com/support',
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3000/api',
        description: 'Development server',
      },
      {
        url: 'https://api.raas.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from login endpoint',
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for service-to-service communication',
        },
        csrfToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-CSRF-Token',
          description: 'CSRF token for state-changing operations',
        },
      },
      schemas: {
        // User Schemas
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            userType: {
              type: 'string',
              enum: ['candidate', 'recruiter', 'hiring_manager', 'admin'],
              description: 'Type of user account',
            },
            isActive: { type: 'boolean' },
            emailVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'email', 'firstName', 'lastName', 'userType'],
        },

        // Job Schemas
        Job: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            requirements: { type: 'string' },
            benefits: { type: 'string' },
            location: { type: 'string' },
            jobType: {
              type: 'string',
              enum: [
                'full-time',
                'part-time',
                'contract',
                'freelance',
                'internship',
              ],
            },
            experienceLevel: {
              type: 'string',
              enum: ['entry-level', 'mid-level', 'senior', 'executive'],
            },
            salaryMin: { type: 'number' },
            salaryMax: { type: 'number' },
            currency: { type: 'string', default: 'USD' },
            requiredSkills: {
              type: 'array',
              items: { type: 'string' },
            },
            status: {
              type: 'string',
              enum: ['draft', 'active', 'paused', 'closed', 'archived'],
            },
            isFeatured: { type: 'boolean' },
            applicationCount: { type: 'number' },
            viewCount: { type: 'number' },
            companyId: { type: 'string', format: 'uuid' },
            createdBy: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: [
            'title',
            'description',
            'location',
            'jobType',
            'experienceLevel',
            'companyId',
          ],
        },

        // Company Schemas
        Company: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            website: { type: 'string', format: 'url' },
            industry: { type: 'string' },
            companySize: {
              type: 'string',
              enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
            },
            location: { type: 'string' },
            logo: { type: 'string', format: 'url' },
            isVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['name', 'industry', 'companySize', 'location'],
        },

        // Application Schemas
        Application: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            jobId: { type: 'string', format: 'uuid' },
            candidateId: { type: 'string', format: 'uuid' },
            status: {
              type: 'string',
              enum: [
                'pending',
                'reviewing',
                'interviewed',
                'offered',
                'hired',
                'rejected',
              ],
            },
            coverLetter: { type: 'string' },
            resume: { type: 'string', format: 'url' },
            appliedAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['jobId', 'candidateId', 'status'],
        },

        // Interview Schemas
        Interview: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            applicationId: { type: 'string', format: 'uuid' },
            interviewerId: { type: 'string', format: 'uuid' },
            scheduledAt: { type: 'string', format: 'date-time' },
            duration: { type: 'number', description: 'Duration in minutes' },
            type: {
              type: 'string',
              enum: ['phone', 'video', 'in-person', 'technical'],
            },
            status: {
              type: 'string',
              enum: ['scheduled', 'completed', 'cancelled', 'no-show'],
            },
            notes: { type: 'string' },
            feedback: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['applicationId', 'interviewerId', 'scheduledAt', 'type'],
        },

        // Response Schemas
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
            error: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
          required: ['success'],
        },

        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array' },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                totalPages: { type: 'number' },
                hasNext: { type: 'boolean' },
                hasPrev: { type: 'boolean' },
              },
            },
          },
          required: ['success', 'data', 'pagination'],
        },

        ValidationError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Validation failed' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                  code: { type: 'string' },
                },
              },
            },
          },
        },

        // Authentication Schemas
        LoginRequest: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
          },
          required: ['email', 'password'],
        },

        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user: { $ref: '#/components/schemas/User' },
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                expiresIn: { type: 'number' },
              },
            },
          },
        },

        RegisterRequest: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            userType: {
              type: 'string',
              enum: ['candidate', 'recruiter', 'hiring_manager'],
            },
          },
          required: ['email', 'password', 'firstName', 'lastName', 'userType'],
        },
      },

      parameters: {
        PageParam: {
          name: 'page',
          in: 'query',
          description: 'Page number for pagination',
          schema: { type: 'integer', minimum: 1, default: 1 },
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          description: 'Number of items per page',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
        SortParam: {
          name: 'sort',
          in: 'query',
          description: 'Sort field and direction (e.g., "createdAt:desc")',
          schema: { type: 'string' },
        },
        SearchParam: {
          name: 'search',
          in: 'query',
          description: 'Search query string',
          schema: { type: 'string' },
        },
      },

      responses: {
        Success: {
          description: 'Operation successful',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiResponse' },
            },
          },
        },
        BadRequest: {
          description: 'Bad request - validation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationError' },
            },
          },
        },
        Unauthorized: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'Authentication required' },
                },
              },
            },
          },
        },
        Forbidden: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: {
                    type: 'string',
                    example: 'Insufficient permissions',
                  },
                },
              },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'Resource not found' },
                },
              },
            },
          },
        },
        TooManyRequests: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'Too many requests' },
                  retryAfter: { type: 'number' },
                },
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'Internal server error' },
                },
              },
            },
          },
        },
      },
    },

    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
      },
      {
        name: 'Users',
        description: 'User management operations',
      },
      {
        name: 'Jobs',
        description: 'Job posting and management operations',
      },
      {
        name: 'Companies',
        description: 'Company profile and management operations',
      },
      {
        name: 'Applications',
        description: 'Job application management operations',
      },
      {
        name: 'Interviews',
        description: 'Interview scheduling and management operations',
      },
      {
        name: 'Monitoring',
        description: 'System monitoring and health check endpoints',
      },
      {
        name: 'Admin',
        description: 'Administrative operations and analytics',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts', './src/models/*.ts'],
};

const specs = swaggerJSDoc(options);

export const setupSwagger = (app: Express): void => {
  const swaggerOptions = {
    explorer: true,
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #2c3e50; }
      .swagger-ui .info .description { color: #34495e; }
      .swagger-ui .scheme-container { 
        background: #ecf0f1; 
        border-radius: 8px; 
        padding: 15px; 
        margin-bottom: 20px; 
      }
    `,
    customSiteTitle: 'RaaS API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayOperationId: false,
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 1,
      docExpansion: 'list',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
  };

  // Serve swagger docs
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));

  // Serve swagger JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
};

export { specs as swaggerSpecs };

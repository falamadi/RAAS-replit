import { Request, Response, NextFunction } from 'express';
import * as zlib from 'zlib';
import { logger } from '../utils/logger';

export class CompressionMiddleware {
  private static compressionThreshold = 1024; // 1KB
  private static supportedEncodings = ['gzip', 'deflate', 'br'];

  static adaptive() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip compression for certain content types
      const skipCompression = [
        'image/',
        'video/',
        'audio/',
        'application/zip',
        'application/gzip',
        'application/octet-stream',
      ];

      const originalSend = res.send.bind(res);
      const originalJson = res.json.bind(res);

      res.send = function (data: any) {
        return compress(this, data, originalSend);
      };

      res.json = function (data: any) {
        return compress(this, JSON.stringify(data), originalJson);
      };

      function compress(
        response: Response,
        data: any,
        originalMethod: Function
      ) {
        const contentType =
          (response.getHeader('content-type') as string) || '';

        // Skip compression for binary content
        if (skipCompression.some(type => contentType.startsWith(type))) {
          return originalMethod.call(response, data);
        }

        // Skip compression for small responses
        const dataSize = Buffer.byteLength(data);
        if (dataSize < CompressionMiddleware.compressionThreshold) {
          return originalMethod.call(response, data);
        }

        // Get accepted encodings
        const acceptEncoding = (req.headers['accept-encoding'] as string) || '';
        const preferredEncoding =
          CompressionMiddleware.getPreferredEncoding(acceptEncoding);

        if (!preferredEncoding) {
          return originalMethod.call(response, data);
        }

        try {
          CompressionMiddleware.compressData(data, preferredEncoding)
            .then(compressed => {
              const compressionRatio = compressed.length / dataSize;

              // Only use compression if it actually reduces size significantly
              if (compressionRatio < 0.9) {
                response.setHeader('content-encoding', preferredEncoding);
                response.setHeader('content-length', compressed.length);
                response.setHeader(
                  'x-compression-ratio',
                  compressionRatio.toFixed(2)
                );

                logger.debug('Response compressed', {
                  encoding: preferredEncoding,
                  originalSize: dataSize,
                  compressedSize: compressed.length,
                  ratio: compressionRatio,
                });

                return response.end(compressed);
              } else {
                return originalMethod.call(response, data);
              }
            })
            .catch(error => {
              logger.error('Compression failed', error);
              return originalMethod.call(response, data);
            });
        } catch (error) {
          logger.error('Compression error', error);
          return originalMethod.call(response, data);
        }
      }

      next();
    };
  }

  private static getPreferredEncoding(acceptEncoding: string): string | null {
    const encodings = acceptEncoding
      .toLowerCase()
      .split(',')
      .map(e => e.trim());

    for (const encoding of this.supportedEncodings) {
      if (encodings.some(e => e.includes(encoding))) {
        return encoding;
      }
    }

    return null;
  }

  private static async compressData(
    data: string | Buffer,
    encoding: string
  ): Promise<Buffer> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    return new Promise((resolve, reject) => {
      switch (encoding) {
        case 'gzip':
          zlib.gzip(buffer, { level: 6 }, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
          break;

        case 'deflate':
          zlib.deflate(buffer, { level: 6 }, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
          break;

        case 'br':
          zlib.brotliCompress(
            buffer,
            {
              params: {
                [zlib.constants.BROTLI_PARAM_QUALITY]: 6,
                [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buffer.length,
              },
            },
            (err, result) => {
              if (err) reject(err);
              else resolve(result);
            }
          );
          break;

        default:
          reject(new Error(`Unsupported encoding: ${encoding}`));
      }
    });
  }

  // Selective compression based on content type and size
  static selective(
    options: {
      threshold?: number;
      types?: string[];
      level?: number;
    } = {}
  ) {
    const {
      threshold = 1024,
      types = [
        'text/',
        'application/json',
        'application/javascript',
        'application/xml',
      ],
      level = 6,
    } = options;

    return (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send.bind(res);

      res.send = function (data: any) {
        const contentType = (this.getHeader('content-type') as string) || '';
        const shouldCompress = types.some(type => contentType.startsWith(type));

        if (!shouldCompress) {
          return originalSend.call(this, data);
        }

        const dataSize = Buffer.byteLength(data);
        if (dataSize < threshold) {
          return originalSend.call(this, data);
        }

        const acceptEncoding = (req.headers['accept-encoding'] as string) || '';

        if (acceptEncoding.includes('gzip')) {
          zlib.gzip(data, { level }, (err, compressed) => {
            if (err) {
              logger.error('Gzip compression failed', err);
              return originalSend.call(this, data);
            }

            this.setHeader('content-encoding', 'gzip');
            this.setHeader('content-length', compressed.length);
            return originalSend.call(this, compressed);
          });
        } else {
          return originalSend.call(this, data);
        }
      };

      next();
    };
  }

  // Stream compression for large responses
  static stream() {
    return (req: Request, res: Response, next: NextFunction) => {
      const acceptEncoding = (req.headers['accept-encoding'] as string) || '';

      if (acceptEncoding.includes('gzip')) {
        const gzip = zlib.createGzip({ level: 6 });

        res.setHeader('content-encoding', 'gzip');

        const originalWrite = res.write.bind(res);
        const originalEnd = res.end.bind(res);

        res.write = function (chunk: any, encoding?: any) {
          return gzip.write(chunk, encoding);
        };

        res.end = function (chunk?: any, encoding?: any) {
          if (chunk) {
            gzip.write(chunk, encoding);
          }
          return gzip.end();
        };

        gzip.pipe(res);
      }

      next();
    };
  }
}

// Response optimization middleware
export const responseOptimizationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const originalJson = res.json.bind(res);

  res.json = function (data: any) {
    // Remove null/undefined values
    const optimized = removeEmptyValues(data);

    // Add performance headers
    this.setHeader('X-Response-Time', Date.now() - req.startTime);
    this.setHeader('X-Optimized', 'true');

    return originalJson.call(this, optimized);
  };

  // Add start time for response time calculation
  (req as any).startTime = Date.now();

  next();
};

function removeEmptyValues(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeEmptyValues).filter(Boolean);
  }

  if (obj && typeof obj === 'object') {
    const cleaned: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (
        value != null &&
        value !== '' &&
        !(Array.isArray(value) && value.length === 0)
      ) {
        cleaned[key] = removeEmptyValues(value);
      }
    }

    return cleaned;
  }

  return obj;
}

// Content negotiation middleware
export const contentNegotiationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const acceptHeader = req.headers.accept || '';

  // Set content type based on Accept header
  if (acceptHeader.includes('application/json')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  } else if (acceptHeader.includes('text/xml')) {
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  } else {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  // Add vary header for proper caching
  res.setHeader('Vary', 'Accept, Accept-Encoding');

  next();
};

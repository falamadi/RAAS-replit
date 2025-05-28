import { Client } from '@elastic/elasticsearch';
import { logger } from '../utils/logger';

let esClient: Client;

export async function connectElasticsearch(): Promise<void> {
  try {
    esClient = new Client({
      node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
      maxRetries: 5,
      requestTimeout: 60000,
      sniffOnStart: true,
    });

    // Test the connection
    const health = await esClient.cluster.health();
    logger.info(`Elasticsearch cluster health: ${health.status}`);
  } catch (error) {
    logger.error('Elasticsearch connection failed:', error);
    throw error;
  }
}

export function getElasticsearchClient(): Client {
  if (!esClient) {
    throw new Error(
      'Elasticsearch not initialized. Call connectElasticsearch() first.'
    );
  }
  return esClient;
}

// Initialize indices
export async function initializeIndices(): Promise<void> {
  const indices = [
    {
      name: 'jobs',
      mappings: {
        properties: {
          id: { type: 'keyword' },
          title: { type: 'text', analyzer: 'standard' },
          description: { type: 'text', analyzer: 'standard' },
          company_name: { type: 'text' },
          location: { type: 'geo_point' },
          skills: { type: 'keyword' },
          salary_min: { type: 'integer' },
          salary_max: { type: 'integer' },
          posted_date: { type: 'date' },
          status: { type: 'keyword' },
        },
      },
    },
    {
      name: 'candidates',
      mappings: {
        properties: {
          id: { type: 'keyword' },
          name: { type: 'text' },
          skills: { type: 'keyword' },
          experience_years: { type: 'integer' },
          location: { type: 'geo_point' },
          availability: { type: 'keyword' },
        },
      },
    },
  ];

  for (const index of indices) {
    try {
      const exists = await esClient.indices.exists({ index: index.name });
      if (!exists) {
        await esClient.indices.create({
          index: index.name,
          body: { mappings: index.mappings },
        });
        logger.info(`Created Elasticsearch index: ${index.name}`);
      }
    } catch (error) {
      logger.error(`Failed to create index ${index.name}:`, error);
    }
  }
}

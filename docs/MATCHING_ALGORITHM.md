# RaaS Matching Algorithm Documentation

## Overview

The RaaS platform uses a sophisticated matching algorithm to connect job seekers with relevant opportunities and help recruiters find the best candidates. The algorithm considers multiple factors and assigns weights to calculate a match score between 0-100%.

## Matching Factors and Weights

The algorithm evaluates the following factors with their respective weights:

| Factor | Weight | Description |
|--------|--------|-------------|
| **Skills Match** | 35% | Technical and soft skills alignment |
| **Experience Match** | 20% | Years of experience vs. job requirements |
| **Location Match** | 15% | Geographic proximity and remote work preferences |
| **Salary Match** | 15% | Salary expectations vs. job offering |
| **Availability Match** | 10% | When the candidate can start |
| **Education Match** | 5% | Educational qualifications alignment |

## Detailed Factor Calculations

### 1. Skills Match (35%)

The most heavily weighted factor, evaluating both required and preferred skills:

- **Required Skills**: 80% of skills score
- **Preferred Skills**: 20% of skills score

```typescript
Skills Score = (Required Matched / Required Total) * 0.8 + 
               (Preferred Matched / Preferred Total) * 0.2
```

The algorithm also considers:
- Years of experience with each skill
- Skill proficiency levels
- Related skills through synonyms

### 2. Experience Match (20%)

Evaluates candidate experience against job requirements:

**Experience Level Ranges:**
- Entry: 0-3 years (ideal: 1 year)
- Mid: 2-7 years (ideal: 4 years)
- Senior: 5-15 years (ideal: 8 years)
- Executive: 10-30 years (ideal: 15 years)

**Scoring Logic:**
- Under-qualified: -20% per year below minimum
- Within range: Score based on proximity to ideal
- Over-qualified: -5% per year above maximum (min 70%)

### 3. Location Match (15%)

Considers geographic factors and remote work preferences:

| Scenario | Score |
|----------|-------|
| Remote job or remote-preferring candidate | 100% |
| Same city | 100% |
| Same state | 80% |
| Different location but willing to relocate | 60% |
| Different location, not willing to relocate | 20% |

### 4. Salary Match (15%)

Evaluates salary expectation alignment:

- **Full overlap**: 100% score
- **Partial overlap**: 50-100% based on overlap percentage
- **No overlap**:
  - Candidate expects less: 90% (usually positive)
  - Candidate expects more: Penalty based on gap percentage

### 5. Availability Match (10%)

Based on when the candidate can start:

| Availability | Score |
|--------------|-------|
| Immediately | 100% |
| Within 1 month | 80% |
| Within 3 months | 50% |
| Not looking | 0% |

### 6. Education Match (5%)

Currently simplified, returns 80% by default. Future enhancements will include:
- Degree level matching
- Field of study relevance
- Certification requirements

## Match Score Interpretation

| Score Range | Interpretation | Recommendation |
|-------------|----------------|----------------|
| 90-100% | Excellent Match | Priority candidate/job |
| 75-89% | Strong Match | Highly recommended |
| 60-74% | Good Match | Worth considering |
| 50-59% | Fair Match | Review other factors |
| Below 50% | Poor Match | Not recommended |

## API Endpoints

### For Job Seekers

**Get Job Recommendations**
```
GET /api/matching/recommendations?limit=20
Authorization: Bearer <token>
```

Returns personalized job recommendations sorted by match score.

### For Recruiters

**Get Similar Candidates**
```
GET /api/matching/job/:jobId/candidates?limit=20
Authorization: Bearer <token>
```

Returns candidates matching the job requirements.

**Calculate All Matches for a Job**
```
POST /api/matching/job/:jobId/calculate
Authorization: Bearer <token>
```

Calculates match scores for all active candidates.

### Shared Endpoints

**Calculate Application Match Score**
```
POST /api/matching/application/:applicationId/calculate
Authorization: Bearer <token>
```

Calculates or recalculates the match score for a specific application.

## Automatic Match Calculation

Match scores are automatically calculated:
1. When a job seeker applies to a job
2. During batch processing (hourly)
3. When explicitly requested via API

## Batch Processing

The system runs several batch jobs to maintain match accuracy:

| Job | Frequency | Purpose |
|-----|-----------|---------|
| Match Score Recalculation | Hourly | Update scores for pending applications |
| Job Recommendations | Every 4 hours | Update cached recommendations |
| Data Cleanup | Daily | Archive old data |
| Statistics Generation | Daily | Generate platform analytics |

## Future Enhancements

1. **Machine Learning Integration**
   - Learn from successful hires
   - Personalize weights per industry
   - Predict candidate success

2. **Advanced Factors**
   - Company culture fit
   - Career trajectory analysis
   - Soft skills assessment
   - Portfolio/work sample evaluation

3. **Real-time Updates**
   - Live score updates as profiles change
   - WebSocket notifications for new matches
   - Collaborative filtering

4. **Industry-Specific Matching**
   - Customized algorithms per industry
   - Domain-specific skill taxonomies
   - Specialized scoring models

## Testing the Algorithm

Use the provided test script:
```bash
cd backend
./test-matching.sh
```

This will:
1. Create test data
2. Calculate match scores
3. Get recommendations
4. Display results

## Performance Considerations

- Match calculations are optimized for batch processing
- Results are cached in Redis for frequently accessed data
- Elasticsearch powers fast candidate searches
- Database indexes optimize query performance

## Privacy and Fairness

The algorithm is designed with fairness in mind:
- No discrimination based on protected characteristics
- Transparent scoring factors
- Option for candidates to see their match scores
- Regular audits for bias detection
// Data stores, services, frameworks and hosting, matched from import paths and manifests.

// [pattern, name, kind]. kind "data" draws in the data row, "external" beside it.
const SERVICES = [
    [/(^|[/._-])(pg|postgres|psycopg2?|asyncpg|pgx|lib\/pq|tokio.postgres|org\.postgresql|npgsql|@neondatabase)($|[/._-])/i, "PostgreSQL", "data"],
    [/(^|[/._-])(mysql2?|mariadb|pymysql|go-sql-driver|mysql-connector)($|[/._-])/i, "MySQL", "data"],
    [/(^|[/._-])(mongodb|mongoose|pymongo|motor|mongo-driver|mongoid)($|[/._-])/i, "MongoDB", "data"],
    [/(^|[/._-])(couchbase|ottoman)($|[/._-])/i, "Couchbase", "data"],
    [/(^|[/._-])(sqlite3?|better-sqlite3|rusqlite|mattn\/go-sqlite3)($|[/._-])/i, "SQLite", "data"],
    [/(^|[/._-])(redis|ioredis|go-redis|redis-py|lettuce|jedis|upstash)($|[/._-])/i, "Redis", "data"],
    [/(^|[/._-])(elasticsearch|opensearch)($|[/._-])/i, "Elasticsearch", "data"],
    [/(^|[/._-])(dynamodb|cassandra|gocql|neo4j|clickhouse)($|[/._-])/i, "NoSQL store", "data"],
    [/(^|[/._-])(prisma)($|[/._-])/i, "Prisma", "data"],
    [/(^|[/._-])(kafkajs|kafka|confluent|sarama)($|[/._-])/i, "Kafka", "external"],
    [/(^|[/._-])(amqplib|rabbitmq|pika|lapin)($|[/._-])/i, "RabbitMQ", "external"],
    [/(^|[/._-])(bullmq|bull|celery|sidekiq|rq|resque)($|[/._-])/i, "Job queue", "external"],
    [/(^|[/._-])(stripe)($|[/._-])/i, "Stripe", "external"],
    [/(^|[/._-])(@aws-sdk|aws-sdk|boto3|botocore)($|[/._-])/i, "AWS", "external"],
    [/(^|[/._-])(@google-cloud|firebase|firebase-admin|google\.cloud)($|[/._-])/i, "Google Cloud", "external"],
    [/(^|[/._-])(@azure|azure)($|[/._-])/i, "Azure", "external"],
    [/(^|[/._-])(@supabase|supabase)($|[/._-])/i, "Supabase", "external"],
    [/(^|[/._-])(cloudinary)($|[/._-])/i, "Cloudinary", "external"],
    [/(^|[/._-])(openai|groq-sdk|groq|@anthropic-ai|anthropic|@google\/generative-ai|langchain)($|[/._-])/i, "LLM provider", "external"],
    [/(^|[/._-])(nodemailer|@sendgrid|sendgrid|resend|mailgun|smtplib)($|[/._-])/i, "Email", "external"],
    [/(^|[/._-])(next-auth|passport|auth0|@clerk|clerk|authlib|oauth2)($|[/._-])/i, "OAuth providers", "external"],
];

const COMPOSE_IMAGES = [
    [/postgres/, "PostgreSQL"],
    [/mysql|mariadb/, "MySQL"],
    [/mongo/, "MongoDB"],
    [/redis|valkey/, "Redis"],
    [/couchbase/, "Couchbase"],
    [/elasticsearch|opensearch/, "Elasticsearch"],
    [/kafka/, "Kafka"],
    [/rabbitmq/, "RabbitMQ"],
    [/minio/, "Object storage"],
];

const KIND_OF_COMPOSE_SERVICE = { Kafka: "external", RabbitMQ: "external" };

export const serviceForImport = (specifier) => {
    // BSON is a serialisation format; importing it doesn't mean there's a database.
    if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.endsWith("/bson")) return null;
    const match = SERVICES.find(([pattern]) => pattern.test(specifier));
    return match ? { name: match[1], kind: match[2] } : null;
};

export const servicesInCompose = (fileEntries) => {
    const services = new Map();
    for (const [filePath, text] of fileEntries) {
        if (!/(^|\/)(docker-)?compose[^/]*\.ya?ml$/.test(filePath)) continue;
        for (const match of text.matchAll(/^\s*image:\s*['"]?([^\s'"]+)/gm)) {
            const service = COMPOSE_IMAGES.find(([pattern]) => pattern.test(match[1]))?.[1];
            if (service) services.set(service, { name: service, kind: KIND_OF_COMPOSE_SERVICE[service] ?? "data" });
        }
    }
    return [...services.values()];
};

// [pattern on an import, framework name, what kind of code it signals].
const FRAMEWORKS = [
    [/^next($|\/)/, "Next.js", "frontend"],
    [/^(react|react-dom)$/, "React", "frontend"],
    [/^vue($|\/)/, "Vue", "frontend"],
    [/^svelte($|\/)/, "Svelte", "frontend"],
    [/^@angular\//, "Angular", "frontend"],
    [/^(solid-js|preact)$/, "Solid", "frontend"],
    [/^(react-native|expo)($|\/)/, "React Native", "frontend"],
    [/^express$/, "Express", "backend"],
    [/^(fastify|koa|hapi|@nestjs\/core)$/, "Node", "backend"],
    [/^(fastapi|starlette)($|\.)/, "FastAPI", "backend"],
    [/^django($|\.)/, "Django", "backend"],
    [/^flask($|\.)/, "Flask", "backend"],
    [/^org\.springframework/, "Spring", "backend"],
    [/^(io\.ktor|io\.micronaut|io\.quarkus)/, "JVM service", "backend"],
    [/gin-gonic\/gin|labstack\/echo|gofiber\/fiber|go-chi\/chi|net\/http$/, "Go service", "backend"],
    [/^(actix_web|axum|rocket|warp)($|::)/, "Rust service", "backend"],
    [/^(rails|sinatra)($|\/)/, "Rails", "backend"],
    [/^(Microsoft\.AspNetCore)/, "ASP.NET", "backend"],
    [/^(Illuminate|Symfony)\\?/, "PHP framework", "backend"],
    [/^(Phoenix)/, "Phoenix", "backend"],
];

export const frameworkForImport = (specifier) => {
    const match = FRAMEWORKS.find(([pattern]) => pattern.test(specifier));
    return match ? { name: match[1], side: match[2] } : null;
};

// Pairs of client and server packages that mean two parts of a repository talk
// over a network, which no import between them could ever show.
export const PROTOCOLS = [
    { label: "WebSocket", client: /^(socket\.io-client|reconnecting-websocket)$/, server: /^(socket\.io|ws|channels|gorilla\/websocket|actix_ws)$/ },
    { label: "GraphQL", client: /^(@apollo\/client|urql|graphql-request)$/, server: /^(graphql|apollo-server|@apollo\/server|strawberry|graphene|gqlgen)/ },
    { label: "gRPC", client: /^(@grpc\/grpc-js|grpc-web)$/, server: /^(grpc|google\.golang\.org\/grpc|tonic|@grpc\/grpc-js)/ },
    {
        label: "REST",
        client: /^(axios|ky|swr|@tanstack\/react-query|node-fetch|got)$/,
        server: /^(express|fastify|koa|@nestjs\/core|fastapi|flask|django|org\.springframework|gin-gonic|labstack\/echo|gofiber|go-chi|actix_web|axum|rails|sinatra)/,
    },
];

const DEPLOY_FILES = [
    [/(^|\/)vercel\.json$/i, "Vercel"],
    [/(^|\/)render\.ya?ml$/i, "Render"],
    [/(^|\/)netlify\.toml$/i, "Netlify"],
    [/(^|\/)fly\.toml$/i, "Fly.io"],
    [/(^|\/)Procfile$/i, "Heroku"],
    [/(^|\/)serverless\.ya?ml$/i, "Serverless"],
    [/(^|\/)app\.ya?ml$/i, "App Engine"],
    [/(^|\/)Chart\.yaml$/i, "Kubernetes"],
];

// Deployment targets, keyed by the folder their config sits in.
export const deployTargetsIn = (filePaths) => {
    const targets = [];
    for (const filePath of filePaths) {
        const match = DEPLOY_FILES.find(([pattern]) => pattern.test(filePath));
        if (match) targets.push({ directory: filePath.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/")) : "", name: match[1] });
    }
    return targets;
};

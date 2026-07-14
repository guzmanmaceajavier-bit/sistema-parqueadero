import dotenv from "dotenv";
dotenv.config();
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_that_is_long_enough_for_testing_123456";
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:230624@localhost:5432/parqueadero_test";

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const METADATA_TABLE = process.env.METADATA_TABLE;

const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

// ✅ Upload Signed URL
export const getSignedUrlUpload = async (event) => {
  try {
    const body = JSON.parse(event.body);
    if (!body.key) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing 'key' parameter" }) };
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: body.key,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    return {
      statusCode: 200,
      body: JSON.stringify({ uploadUrl, key: body.key }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// ✅ Get Signed URL
export const getSignedUrlGet = async (event) => {
  try {
    const key = event.queryStringParameters?.key;
    if (!key) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing 'key' parameter" }) };
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const getUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    return {
      statusCode: 200,
      body: JSON.stringify({ getUrl, key }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

//DynamoDB Lambda Function
export const saveMetadata = async (event) => {
  try {
    const record = event.Records[0];
    const bucketName = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const size = record.s3.object.size;
    const eventTime = record.eventTime;

    const params = {
      TableName: METADATA_TABLE,
      Item: {
        id: key,          // object key as primary key
        bucketName,
        size,
        uploadedAt: eventTime
      }
    };

    await docClient.send(new PutCommand(params));

    console.log("Metadata saved successfully:", params.Item);
    return { statusCode: 200, body: "Metadata saved successfully" };
  } catch (err) {
    console.error("Error saving metadata:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// ✅ Delete Object from S3 and DynamoDB
export const deletes3object = async (event) => {
  try {
    let id = event.pathParameters?.id;
    console.log("Raw id from path:", id);

    // Decode URL-encoded path
    id = decodeURIComponent(id);
    console.log("Decoded id:", id);

    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing 'id' parameter" }),
      };
    }
/*   

    console.log("Received DELETE request");
    console.log("Path parameter id:", id);
    console.log("Bucket name:", BUCKET_NAME);
    console.log("DynamoDB table:", METADATA_TABLE);
 */

    // Step 1: Delete object from S3
    const s3DeleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: id, // 👈 must match the key you used during upload
    });
    await s3.send(s3DeleteCommand);

    // Step 2: Delete metadata from DynamoDB
    const dbDeleteCommand = new DeleteCommand({
      TableName: METADATA_TABLE,
      Key: { id },
    });
    await docClient.send(dbDeleteCommand);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Deleted successfully: ${id}` }),
    };
  } catch (err) {
    console.error("Error deleting object:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
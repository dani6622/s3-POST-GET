import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

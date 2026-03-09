/**
 * Figma REST API クライアント
 * 環境変数 FIGMA_ACCESS_TOKEN で認証
 *
 * トークン取得: Figma > Settings > Security > Personal access tokens > Generate new token
 * スコープ: file_content:read
 */

const FIGMA_API = "https://api.figma.com/v1";

function getToken(): string {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "FIGMA_ACCESS_TOKEN が未設定です。.env.local にトークンを設定してください。" +
        "取得: Figma > Settings > Security > Personal access tokens"
    );
  }
  return token;
}

/**
 * Figma ファイルのノードを取得
 * @param fileKey - ファイルURLの figma.com/file/{fileKey}/ の部分
 * @param nodeId - ノードID（例: "55-291"、URLの node-id= の値）
 */
export async function getFigmaNode(
  fileKey: string,
  nodeId: string
): Promise<unknown> {
  const token = getToken();
  const res = await fetch(
    `${FIGMA_API}/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`,
    {
      headers: {
        "X-Figma-Token": token,
      },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma API error ${res.status}: ${body}`);
  }

  return res.json();
}

/**
 * Figma ファイル全体を取得
 */
export async function getFigmaFile(fileKey: string): Promise<unknown> {
  const token = getToken();
  const res = await fetch(`${FIGMA_API}/files/${fileKey}`, {
    headers: {
      "X-Figma-Token": token,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma API error ${res.status}: ${body}`);
  }

  return res.json();
}

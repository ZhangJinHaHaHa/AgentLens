/**
 * 评价交易写入器：先对裁剪后的 UTF-8 评论计算 SHA-256，再把 token、六维评分和哈希提交到链上并等待确认。
 * 输入含 registry 地址与用户 signer，输出交易哈希和 commentHash；函数会触发钱包/网络副作用，但不会上传明文、缓存状态或保存评论。
 * 地址、chainId、评分范围和 token 存在性未由前端验证，合约才是最终约束；随后保存明文时必须使用完全相同的 trim+UTF-8 哈希规则核对绑定。
 * 用户拒绝、revert 或确认失败直接抛出，没有自动重试；交易已广播但状态未知时应先查链，避免生成重复评价。
 * 返回哈希只能证明本次提交所承诺的字节摘要，不能证明评论内容安全、真实或已成功写入独立 HTTP 存储。
 */
import { Contract, sha256, toUtf8Bytes, type InterfaceAbi, type JsonRpcSigner } from "ethers";

import reviewArtifact from "../../../contracts/artifacts/AgentReviewRegistry.json";

export type SixDimensionalRatings = [number, number, number, number, number, number];

export interface SubmitReviewInput {
  reviewRegistryAddress: string;
  signer: JsonRpcSigner;
  tokenId: bigint;
  ratings: SixDimensionalRatings;
  commentText: string;
}

export async function submitReview(input: SubmitReviewInput): Promise<{ hash: string; commentHash: string }> {
  const commentHash = hashReviewComment(input.commentText);
  const contract = new Contract(
    input.reviewRegistryAddress,
    reviewArtifact.abi as InterfaceAbi,
    input.signer
  );
  const tx = await contract.submitReview(input.tokenId, input.ratings, commentHash);
  await tx.wait();
  return { hash: tx.hash as string, commentHash };
}

export function hashReviewComment(commentText: string): string {
  return sha256(toUtf8Bytes(commentText.trim()));
}

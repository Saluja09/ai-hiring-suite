import { afterEach, describe, expect, it, vi } from "vitest";
import { api, type CreateAgentRequest, type CreateAgentResponse } from "../lib/api";

describe("api.createAgent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /api/agents with a JSON body and returns the parsed response", async () => {
    const requestBody: CreateAgentRequest = {
      name: "Screener Bot",
      voice_persona: "NEHA",
      agent_prompt: "You are a helpful hiring screener.",
      objective: "Screen candidates for the Backend Engineer role.",
      introduction: "Hi, I'm calling about the Backend Engineer role.",
      result_prompt: "Summarize the candidate's fit.",
      result_schema: { fit: "string" },
    };

    const responseBody: CreateAgentResponse = {
      campaign_id: 42,
      agent_id: "agent_123",
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => responseBody,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.createAgent(requestBody);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toContain("/api/agents");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init?.body as string)).toEqual(requestBody);

    expect(result).toEqual(responseBody);
  });

  it("throws an Error with the response detail on non-2xx responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: "name is required" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      api.createAgent({
        name: "",
        voice_persona: "NEHA",
        agent_prompt: "x",
        objective: "x",
        introduction: "x",
        result_schema: { fit: "string" },
      } as CreateAgentRequest),
    ).rejects.toThrow("name is required");
  });
});

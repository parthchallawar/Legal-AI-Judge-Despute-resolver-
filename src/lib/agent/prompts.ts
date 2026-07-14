// Prompts for the agentic adjudication graph. Kept in one place so they are easy
// to tune. Each node calls aiService.callAI(model, messages) and parses JSON via
// aiService.extractJson().

export function triagePrompt(caseData: any, analysis: any): { system: string; user: string } {
    const system = `
    You are an AI Case Triage Officer for an Online Dispute Resolution platform.
    Classify the dispute so it can be routed correctly. Be decisive.

    Output Format (JSON only):
    {
        "disputeType": "one of: refund, contract-breach, service-quality, payment, property, defamation, other",
        "complexity": "one of: low, medium, high",
        "mediationRecommended": true or false,
        "summary": "one sentence describing the core of the dispute"
    }

    Guidance:
    - complexity is "low" for small, clear, single-issue disputes; "high" for multi-issue,
      high-value, or heavily contested disputes with conflicting evidence.
    - mediationRecommended is true when the parties likely have a workable middle ground
      (e.g. partial refunds, payment plans, redelivery) and false for all-or-nothing or
      bad-faith disputes.
    `
    const user = `
    Case Title: ${caseData.title}
    Claimant's Description: ${caseData.description}
    Respondent's Response: ${caseData.respondentDescription || "No response provided."}
    Normalized Analysis: ${JSON.stringify(analysis)}
    `
    return { system, user }
}

export function ragGradePrompt(query: string, retrieved: string): { system: string; user: string } {
    const system = `
    You are a retrieval relevance grader for a legal dispute system. Decide how relevant the
    retrieved policy excerpts are to the dispute, and if they are weak, propose a better search
    query focused on the legal concepts that actually matter here.

    Output Format (JSON only):
    {
        "grade": a number from 0 to 1 (0 = irrelevant, 1 = directly on point),
        "refinedQuery": "a focused re-query string (legal concepts, remedies, obligations)"
    }
    `
    const user = `
    Dispute (search query used): ${query.slice(0, 2000)}

    Retrieved policy excerpts:
    ${retrieved ? retrieved.slice(0, 4000) : "NOTHING WAS RETRIEVED."}
    `
    return { system, user }
}

export function confidencePrompt(state: {
    verdict: any
    biasCheck: any
    ragGrade: number
    complexity: string | null
    caseData: any
}): { system: string; user: string } {
    const system = `
    You are an AI Adjudication Confidence Assessor. Given a verdict, the co-judge's bias check,
    the strength of the retrieved legal context, the dispute complexity, and how much evidence
    was available, estimate how confident the platform should be that this AI verdict is correct
    and safe to issue automatically.

    Output Format (JSON only):
    {
        "confidence": a number from 0 to 1,
        "factors": "one or two sentences justifying the score"
    }

    Lower the score when: evidence is thin, retrieved legal context was weak, the dispute is
    high complexity, or the bias check only barely passed. Raise it when the verdict is well
    grounded in cited rules and concrete evidence.
    `
    const user = `
    Verdict: ${state.verdict?.content}
    Reasoning: ${state.verdict?.reasoning}
    Citations: ${JSON.stringify(state.verdict?.citations || [])}
    Bias check passed: ${state.biasCheck?.passed} — ${state.biasCheck?.reasoning}
    Retrieved-context relevance grade (0-1): ${state.ragGrade}
    Dispute complexity: ${state.complexity}
    Evidence files attached: ${state.caseData?.documents?.length || 0}
    Respondent responded: ${state.caseData?.respondentDescription ? "yes" : "no"}
    `
    return { system, user }
}

export function mediationPrompt(caseData: any, analysis: any): { system: string; user: string } {
    const system = `
    You are an AI Mediator. Before any binding verdict is issued, propose a fair settlement that
    both parties might accept. Offer concrete, specific compromise terms (amounts, actions,
    timelines) — not vague suggestions.

    Output Format (JSON only):
    {
        "proposal": "a short paragraph describing the proposed settlement and why it is fair",
        "terms": ["concrete term 1", "concrete term 2", "concrete term 3"]
    }
    `
    const user = `
    Case Title: ${caseData.title}
    Claimant's Description: ${caseData.description}
    Respondent's Response: ${caseData.respondentDescription || "No response provided."}
    Normalized Analysis: ${JSON.stringify(analysis)}
    `
    return { system, user }
}

export function evidenceSufficiencyPrompt(
    caseData: any,
    analysis: any,
    evidenceText: string
): { system: string; user: string } {
    const system = `
    You are an AI Evidence Reviewer. Decide whether there is enough evidence to fairly decide
    this dispute, or whether one specific, high-value piece of evidence from one party would
    materially change the fairness of the outcome.

    Output Format (JSON only):
    {
        "sufficient": true or false,
        "targetParty": "CLAIMANT" or "RESPONDENT" (which party should provide it; ignored if sufficient),
        "question": "a single, specific request for the missing evidence (ignored if sufficient)"
    }

    Only request evidence when it is genuinely decision-changing. If the case can be decided
    fairly on what exists — including the extracted evidence file contents below, not just
    their filenames — return sufficient: true. Never ask for more than one thing.
    `
    const user = `
    Case Title: ${caseData.title}
    Claimant's Description: ${caseData.description}
    Respondent's Response: ${caseData.respondentDescription || "No response provided."}
    Evidence files attached (images are examined separately, not listed here): ${caseData.documents?.map((d: any) => `${d.type}:${d.url.split("/").pop()}`).join(", ") || "none"}

    Evidence file contents (extracted from PDFs/text files, where available):
    ${evidenceText || "No extractable text evidence."}

    Normalized Analysis: ${JSON.stringify(analysis)}
    `
    return { system, user }
}

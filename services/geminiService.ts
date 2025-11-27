import { GoogleGenAI, Type } from "@google/genai";
import { SimulationResult, ScriptMode } from "../types";

export const simulateRenaming = async (
  baseName: string,
  filenames: string[],
  mode: ScriptMode
): Promise<SimulationResult[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let prompt = "";
  let schema = null;

  if (mode === 'series') {
    prompt = `
      You are a file system utility for Jellyfin media servers (Python script logic).
      The user is organizing a TV Show named "${baseName}".
      
      Analyze the following list of filenames. For each file:
      1. Identify if it is a video file.
      2. Extract the Season number and Episode number.
      3. Generate the new filename: "${baseName} - S{season:02}E{episode:02}.{extension}"
      4. Determine target folder: "Season {season:02}"
      
      Rules:
      - S01E02, 1x02, 101 (Season 1 Ep 1) are valid.
      - Ignore years (2020) as episode numbers.
      
      Filenames:
      ${JSON.stringify(filenames)}
    `;
  } else {
    // MOVIE MODE
    prompt = `
      You are a file system utility for Jellyfin media servers.
      The user is scanning a folder "${baseName}" for movies.
      
      Analyze the list of filenames. For each file:
      1. Extract the Movie Title and Year from the filename.
         Pattern: Title.Name.Year.ext or Title Name (Year).ext
      2. Generate the new filename: "Title (Year).{extension}"
      3. Determine target folder: "Movies/Title (Year)"
      
      Rules:
      - Look for 4 digits (1900-2030) as year.
      - Everything before the year is the title. replace dots with spaces.
      
      Filenames:
      ${JSON.stringify(filenames)}
    `;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              originalName: { type: Type.STRING },
              newName: { type: Type.STRING },
              targetFolder: { type: Type.STRING },
              season: { type: Type.INTEGER },
              episode: { type: Type.INTEGER },
              year: { type: Type.STRING },
              isValid: { type: Type.BOOLEAN },
              reason: { type: Type.STRING }
            },
            required: ["originalName", "isValid"]
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as SimulationResult[];
    }
    return [];
  } catch (error) {
    console.error("Gemini Simulation Failed:", error);
    throw error;
  }
};
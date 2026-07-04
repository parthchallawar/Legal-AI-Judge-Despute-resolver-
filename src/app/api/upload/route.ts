import { NextResponse } from "next/server"
import { writeFile } from "fs/promises"
import path from "path"

export async function POST(req: Request) {
    try {
        const formData = await req.formData()
        const file = formData.get("file") as File

        if (!file) {
            return NextResponse.json({ error: "No file received." }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const filename = Date.now() + "_" + file.name.replaceAll(" ", "_")
        const uploadDir = path.join(process.cwd(), "public/uploads")

        try {
            await writeFile(path.join(uploadDir, filename), buffer)
        } catch (error) {
            console.error("Error saving file:", error)
            return NextResponse.json({ error: "Failed to save file." }, { status: 500 })
        }

        return NextResponse.json({
            url: `/uploads/${filename}`,
            name: file.name,
            type: file.type
        })
    } catch (error) {
        console.error("Upload error:", error)
        return NextResponse.json({ error: "Upload failed." }, { status: 500 })
    }
}

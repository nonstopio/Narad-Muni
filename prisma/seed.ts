import {PrismaClient} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    await prisma.platformConfig.upsert({
        where: {id: "default-slack"},
        update: {},
        create: {
            id: "default-slack",
            platform: "SLACK",
            userName: "",
            userId: "",
            webhookUrl: "",
            slackThreadMode: true,
            isActive: true,
        },
    });

    await prisma.platformConfig.upsert({
        where: {id: "default-teams"},
        update: {},
        create: {
            id: "default-teams",
            platform: "TEAMS",
            userName: "",
            userId: "",
            webhookUrl: "",
            isActive: true,
        },
    });

    await prisma.platformConfig.upsert({
        where: {id: "default-jira"},
        update: {},
        create: {
            id: "default-jira",
            platform: "JIRA",

            baseUrl: "",
            projectKey: "",
            email: "",
            apiToken: "",
            timezone: "Asia/Kolkata",
            isActive: true,
            repeatEntries: {
                create: [],
            },
        },
    });

    await prisma.appSettings.upsert({
        where: {id: "app-settings"},
        update: {},
        create: {id: "app-settings", aiProvider: "local-claude"},
    });

    console.log("Seed completed successfully");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

import {
  acceptance,
  publishToMessageBus,
} from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";

function usersFixture() {
  return [
    {
      id: 1,
      username: "bruce0",
      name: "Bruce Wayne",
      avatar_template: "/letter_avatar_proxy/v4/letter/b/90ced4/{size}.png",
    },
    {
      id: 2,
      username: "bruce1",
      name: "Bruce Wayne",
      avatar_template: "/letter_avatar_proxy/v4/letter/b/9de053/{size}.png",
    },
    {
      id: 3,
      username: "bruce2",
      name: "Bruce Wayne",
      avatar_template: "/letter_avatar_proxy/v4/letter/b/35a633/{size}.png",
    },
  ];
}
acceptance("Presence - Subscribing", function (needs) {
  needs.pretender((server, helper) => {
    server.get("/presence/get", () => {
      return helper.response({
        count: 3,
        last_message_id: 1,
        users: usersFixture(),
      });
    });
  });

  test("subscribing and receiving updates", async function (assert) {
    let presenceService = this.container.lookup("service:presence");
    let channel = presenceService.getChannel("mychannel");
    assert.equal(channel.name, "mychannel");

    await channel.subscribe({
      users: usersFixture(),
      last_message_id: 1,
    });

    assert.equal(channel.users.length, 3, "it starts with three users");

    publishToMessageBus(
      "/presence/mychannel",
      {
        leaving_user_ids: [1],
      },
      0,
      2
    );

    assert.equal(channel.users.length, 2, "one user is removed");

    publishToMessageBus(
      "/presence/mychannel",
      {
        entering_users: [usersFixture()[0]],
      },
      0,
      3
    );

    assert.equal(channel.users.length, 3, "one user is added");
  });

  test("fetches data when no initial state", async function (assert) {
    let presenceService = this.container.lookup("service:presence");
    let channel = presenceService.getChannel("mychannel");

    await channel.subscribe();

    assert.equal(channel.users.length, 3, "loads initial state");

    publishToMessageBus(
      "/presence/mychannel",
      {
        leaving_user_ids: [1],
      },
      0,
      2
    );

    assert.equal(
      channel.users.length,
      2,
      "updates following messagebus message"
    );

    publishToMessageBus(
      "/presence/mychannel",
      {
        leaving_user_ids: [2],
      },
      0,
      99
    );

    await channel._resubscribePromise;

    assert.equal(
      channel.users.length,
      3,
      "detects missed messagebus message, fetches data from server"
    );
  });
});

acceptance("Presence - Entering and Leaving", function (needs) {
  needs.user();

  const requests = [];
  needs.hooks.afterEach(() => requests.clear());
  needs.pretender((server, helper) => {
    server.post("/presence/update", (request) => {
      const body = new URLSearchParams(request.requestBody);
      requests.push(body);
      return helper.response({});
    });
  });

  test("can join and leave channels", async function (assert) {
    const presenceService = this.container.lookup("service:presence");
    const channel = presenceService.getChannel("mychannel");

    await channel.enter();
    assert.equal(requests.length, 1, "updated the server for enter");
    let presentChannels = requests.pop().getAll("present_channels[]");
    assert.deepEqual(
      presentChannels,
      ["mychannel"],
      "included the correct present channel"
    );

    await channel.leave();
    assert.equal(requests.length, 1, "updated the server for leave");
    const request = requests.pop();
    presentChannels = request.getAll("present_channels[]");
    const leaveChannels = request.getAll("leave_channels[]");
    assert.deepEqual(presentChannels, [], "included no present channels");
    assert.deepEqual(
      leaveChannels,
      ["mychannel"],
      "included the correct leave channel"
    );
  });
});

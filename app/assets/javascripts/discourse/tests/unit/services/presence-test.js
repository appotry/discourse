import {
  acceptance,
  publishToMessageBus,
} from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";
import { PresenceChannelNotFound } from "discourse/services/presence";

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
    server.get("/presence/get", (request) => {
      if (request.queryParams.channel?.startsWith("/test/")) {
        return helper.response({
          count: 3,
          last_message_id: 1,
          users: usersFixture(),
        });
      }

      return helper.response(404, {});
    });
  });

  test("subscribing and receiving updates", async function (assert) {
    let presenceService = this.container.lookup("service:presence");
    let channel = presenceService.getChannel("/test/ch1");
    assert.equal(channel.name, "/test/ch1");

    await channel.subscribe({
      users: usersFixture(),
      last_message_id: 1,
    });

    assert.equal(channel.users.length, 3, "it starts with three users");

    publishToMessageBus(
      "/presence/test/ch1",
      {
        leaving_user_ids: [1],
      },
      0,
      2
    );

    assert.equal(channel.users.length, 2, "one user is removed");

    publishToMessageBus(
      "/presence/test/ch1",
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
    let channel = presenceService.getChannel("/test/ch1");

    await channel.subscribe();

    assert.equal(channel.users.length, 3, "loads initial state");

    publishToMessageBus(
      "/presence/test/ch1",
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
      "/presence/test/ch1",
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

  test("raises error when subscribing to nonexistent channel", async function (assert) {
    let presenceService = this.container.lookup("service:presence");
    let channel = presenceService.getChannel("/nonexistent/ch1");

    assert.rejects(
      channel.subscribe(),
      PresenceChannelNotFound,
      "raises not found"
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

      const response = {};
      const channelsRequested = body.getAll("present_channels[]");
      channelsRequested.forEach((c) => {
        if (c.startsWith("/test/")) {
          response[c] = true;
        } else {
          response[c] = false;
        }
      });

      return helper.response(response);
    });
  });

  test("can join and leave channels", async function (assert) {
    const presenceService = this.container.lookup("service:presence");
    const channel = presenceService.getChannel("/test/ch1");

    await channel.enter();
    assert.equal(requests.length, 1, "updated the server for enter");
    let presentChannels = requests.pop().getAll("present_channels[]");
    assert.deepEqual(
      presentChannels,
      ["/test/ch1"],
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
      ["/test/ch1"],
      "included the correct leave channel"
    );
  });

  test("raises an error when entering a non-existant channel", async function (assert) {
    const presenceService = this.container.lookup("service:presence");
    const channel = presenceService.getChannel("/blah/doesnotexist");
    await assert.rejects(
      channel.enter(),
      PresenceChannelNotFound,
      "raises a not found error"
    );
  });
});

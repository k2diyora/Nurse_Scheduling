describe("index bootstrap", () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '<div id="root"></div>';
  });

  test("creates root and renders app", () => {
    const mockRender = jest.fn();
    const mockCreateRoot = jest.fn(() => ({ render: mockRender }));

    jest.doMock("react-dom/client", () => ({
      __esModule: true,
      default: { createRoot: mockCreateRoot },
    }));

    jest.doMock("../App", () => ({
      __esModule: true,
      default: () => null,
    }));

    require("../index");

    expect(mockCreateRoot).toHaveBeenCalledWith(
      document.getElementById("root"),
    );
    expect(mockRender).toHaveBeenCalledTimes(1);
  });
});